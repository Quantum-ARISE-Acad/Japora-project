import { Suspense } from "react";
import CustomSignIn from "@/components/auth/CustomSignIn";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <CustomSignIn />
    </Suspense>
  );
}
