import { getApiBaseUrl } from "@agu/config";
import type { Metadata } from "next";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = {
  title: "Giriş Yap | AGÜ Kampüs Takvimi",
  description: "AGÜ Kampüs Takvimi e-posta doğrulama kodu ile giriş ekranı."
};

export type LoginRawSearchParams = {
  returnTo?: string | string[];
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<LoginRawSearchParams>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const returnToRaw = Array.isArray(resolvedParams.returnTo)
    ? resolvedParams.returnTo[0]
    : resolvedParams.returnTo;

  const apiBaseUrl = getApiBaseUrl();

  return <LoginScreen apiBaseUrl={apiBaseUrl} returnTo={returnToRaw ?? undefined} />;
}
