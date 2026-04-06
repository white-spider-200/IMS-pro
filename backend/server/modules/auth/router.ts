import { Router } from "express";
import { requireAuth } from "../../auth.js";
import { changePassword, getMe, login, updateMe } from "./auth.service.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const result = await login(email, password);
  if (!result) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.json(result);
});

router.get("/me", requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const user = await getMe(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.put("/me", requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { displayName, phone, location, photoURL } = req.body ?? {};
  const user = await updateMe(userId, { displayName, phone, location, photoURL });
  res.json(user);
});

router.put("/me/password", requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }
  const ok = await changePassword(userId, currentPassword, newPassword);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  res.json({ success: true });
});

export default router;

