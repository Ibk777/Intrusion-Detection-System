import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Mock database for traffic logs (in a real app, this would be Firestore)
  // We'll use this to store logs before they are synced to Firebase if needed,
  // but for this project, we'll mostly rely on the frontend sending logs to Firestore
  // or the backend doing it.
  
  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Middleware to log all requests (The "Sensor" part of IDS)
  app.use((req, res, next) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'],
      payload: req.body,
      headers: req.headers,
    };
    
    // In a real IDS, we'd analyze this logEntry here.
    // For this demo, we'll just log it to console and let the frontend handle the "detection" 
    // or provide an endpoint for the frontend to fetch these logs.
    console.log(`[TRAFFIC] ${logEntry.method} ${logEntry.path} from ${logEntry.ip}`);
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
