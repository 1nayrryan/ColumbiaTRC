require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Op } = require("sequelize");
const { expressjwt: jwt } = require("express-jwt");
const jwks = require("jwks-rsa");
const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");

const sequelize = require("./db");
const TrcRecord = require("./models/Record");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

const auth = jwt({
  secret: jwks.expressJwtSecret({
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

function requireAdmin(req, res, next) {
  const claim = process.env.AUTH0_ROLE_CLAIM || "https://columbiatrc.example.com/roles";
  const roles = req.auth?.[claim] || req.auth?.roles || [];
  const isAdmin = Array.isArray(roles) ? roles.includes("admin") : roles === "admin";
  if (!isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

function buildWhere(query) {
  const where = {};
  if (query.keyword) {
    where[Op.or] = [
      { country: { [Op.iLike]: `%${query.keyword}%` } },
      { title: { [Op.iLike]: `%${query.keyword}%` } },
      { caseType: { [Op.iLike]: `%${query.keyword}%` } },
    ];
  }
  if (query.country) where.country = query.country;
  if (query.severity) where.severity = query.severity;
  return where;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/records", async (req, res, next) => {
  try {
    const records = await TrcRecord.findAll({
      where: buildWhere(req.query),
      order: [["id", "ASC"]],
    });
    res.json(records);
  } catch (error) {
    next(error);
  }
});

app.get("/records/csv", async (req, res, next) => {
  try {
    const records = await TrcRecord.findAll({
      where: buildWhere(req.query),
      order: [["id", "ASC"]],
      raw: true,
    });
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [
      ["Country", "Title", "Case Type", "Severity", "Document URL"].map(escapeCsv).join(","),
      ...records.map((record) =>
        [record.country, record.title, record.caseType, record.severity, record.documentUrl]
          .map(escapeCsv)
          .join(","),
      ),
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="trc-records.csv"');
    res.send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});

app.post("/records", auth, requireAdmin, async (req, res, next) => {
  try {
    const record = await TrcRecord.create(req.body);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

app.put("/records/:id", auth, requireAdmin, async (req, res, next) => {
  try {
    const record = await TrcRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    await record.update(req.body);
    res.json(record);
  } catch (error) {
    next(error);
  }
});

app.delete("/records/:id", auth, requireAdmin, async (req, res, next) => {
  try {
    const record = await TrcRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    await record.destroy();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/records/:id/document", auth, requireAdmin, upload.single("pdf"), async (req, res, next) => {
  try {
    const connection = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connection || connection.includes("replace")) {
      return res.status(500).json({ error: "Azure Blob Storage is not configured" });
    }
    if (!req.file) return res.status(400).json({ error: "PDF file is required" });
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are allowed" });
    }

    const record = await TrcRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    const containerName = process.env.AZURE_STORAGE_CONTAINER || "trc-records";
    const blobService = BlobServiceClient.fromConnectionString(connection);
    const container = blobService.getContainerClient(containerName);
    await container.createIfNotExists();
    const blobName = `${record.id}-${Date.now()}-${req.file.originalname}`;
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: "application/pdf" },
    });
    await record.update({ documentUrl: blockBlob.url });
    res.json(record);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  console.error(error);
  res.status(500).json({ error: "Server error" });
});

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  const count = await TrcRecord.count();
  if (count === 0) {
    await TrcRecord.bulkCreate([
      { country: "Canada", title: "Residential Schools Inquiry", caseType: "Historical injustice", severity: "High" },
      { country: "South Africa", title: "Human Rights Violations Record", caseType: "Commission hearing", severity: "High" },
      { country: "Rwanda", title: "Post-Conflict Justice Review", caseType: "Community testimony", severity: "Medium" },
    ]);
  }
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error("Failed to start API:", error);
  process.exit(1);
});
