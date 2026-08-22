import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import errorHandler from "./middleware/errorHandler.ts";
import corsOptions from "./config/corsOptions.ts";
import credentials from "./middleware/credentials.ts";
import routes from "./routes/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(credentials);
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use("/", express.static(path.join(__dirname, "public")));

app.use("/api/v1", routes);

app.use(errorHandler); // must stay last

export default app;
