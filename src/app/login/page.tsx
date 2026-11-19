import { Suspense } from "react";
import CustomSignIn from "@/components/auth/CustomSignIn";
import { getServerTr } from "@/lib/public-locale";

export default async function LoginPage() {
  const tr = await getServerTr();
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">{tr("Chargement...", "Loading...")}</div>}>
      <CustomSignIn />
    </Suspense>
  );
}
