"use client";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";

export default function AdminTest() {
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);

  async function checkRole() {
    if (!user) {
      setResult({ error: "No user logged in" });
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        setResult({ error: "User document does not exist" });
        return;
      }

      const data = userDoc.data();
      setResult({
        success: true,
        userId: user.uid,
        email: user.email,
        documentData: data,
        roleField: data?.role,
        roleType: typeof data?.role,
        allFields: Object.keys(data || {}),
      });
    } catch (error: any) {
      setResult({ error: error.message });
    }
  }

  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto card">
        <h1 className="text-2xl font-semibold mb-4">Admin Role Debug Test</h1>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Current Auth State:
            </p>
            <pre className="bg-surface p-3 rounded text-xs overflow-auto">
              {JSON.stringify(
                {
                  loggedIn: !!user,
                  email: user?.email,
                  uid: user?.uid,
                },
                null,
                2
              )}
            </pre>
          </div>

          <button className="btn" onClick={checkRole}>
            Check Role in Firestore
          </button>

          {result && (
            <div>
              <p className="text-sm font-medium mb-2">Firestore Result:</p>
              <pre className="bg-surface p-3 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
