import express from "express";
import router from "./routes/index";

const app = express();
app.use(express.json());

// API istekleri /api ile başlamalıdır
app.use("/api", router);

const PORT = 3000;
app.listen(PORT, () => {
  console.log("Backend sunucusu 3000 portunda çalışıyor!");
});
