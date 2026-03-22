import { GoogleGenAI, Type } from "@google/genai";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface TrafficLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  payload: any;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  threatType?: string;
  analysis?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const analyzeTraffic = async (log: Partial<TrafficLog>): Promise<{
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  threatType?: string;
  analysis: string;
}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this web traffic log for potential security threats (SQL injection, XSS, Brute Force, Path Traversal, etc.). 
      Return a JSON object with:
      - threatLevel: "low", "medium", "high", or "critical"
      - threatType: A short name for the threat (e.g., "SQL Injection") or null if none
      - analysis: A brief explanation of why it was flagged or why it's safe.

      Log: ${JSON.stringify(log)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            threatLevel: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
            threatType: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["threatLevel", "analysis"]
        }
      }
    });

    const analysis = JSON.parse(response.text);
    
    // Save to Firestore if user is authenticated
    if (auth.currentUser) {
      const path = 'logs';
      try {
        await addDoc(collection(db, path), {
          ...log,
          ...analysis,
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }

    return analysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      threatLevel: 'low',
      analysis: "Unable to analyze traffic at this time."
    };
  }
};
