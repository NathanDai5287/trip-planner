"use server";

import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || password.length < 6) {
    return { error: "Email and password (min 6 chars) are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name: name || null, email, hashedPassword },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return { error: "Account created but sign-in failed. Please log in." };
  }

  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error: any) {
    if (error?.type === "CredentialsSignin") {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  redirect("/dashboard");
}
