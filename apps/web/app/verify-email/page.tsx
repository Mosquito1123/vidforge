"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = React.useState("Verifying...");

  React.useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("Missing token");
      return;
    }
    api.verifyEmail(token).then(({ error }) => {
      if (error) {
        setStatus("Verification failed");
        toast({ title: "Verification failed", description: error, variant: "destructive" });
        return;
      }
      setStatus("Email verified");
      toast({ title: "Email verified", variant: "success" });
      setTimeout(() => router.push("/login"), 1500);
    });
  }, [params, router]);

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{status}</p>
        </CardContent>
      </Card>
    </div>
  );
}
