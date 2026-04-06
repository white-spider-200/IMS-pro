import { prisma } from "../../prisma.js";
import { checkPassword, hashPassword, signToken } from "../../auth.js";
import { deserializeRow } from "../../db.js";

export async function login(email: string, password: string) {
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user || !checkPassword(password, user.password_hash)) return null;

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login: new Date().toISOString() },
  });

  const token = signToken(user.id, user.email, user.role);
  const { password_hash: _, ...safeUserRaw } = user;
  const safeUser = deserializeRow("users", safeUserRaw);
  return { token, user: safeUser };
}

export async function getMe(userId: string) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) return null;
  const { password_hash: _, ...safeUserRaw } = user;
  return deserializeRow("users", safeUserRaw);
}

export async function updateMe(userId: string, data: { displayName?: string; phone?: string; location?: string; photoURL?: string }) {
  await prisma.users.update({
    where: { id: userId },
    data: {
      displayname: data.displayName,
      phone: data.phone,
      location: data.location,
      photourl: data.photoURL,
    },
  });
  return getMe(userId);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user || !checkPassword(currentPassword, user.password_hash)) return false;
  await prisma.users.update({
    where: { id: userId },
    data: { password_hash: hashPassword(newPassword) },
  });
  return true;
}

