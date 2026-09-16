import express from "express";

const app = express();

const port = process.env.PORT ? Number(process.env.PORT) : 7001;

app.get("/", (_req, res) => {
  res.json({ service: "trading-api", status: "ok" });
});

app.listen(port, () => {
  console.log(`[api] listening on port ${port.toString()}`);
});
