import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useToast } from "./ui/use-toast";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Import from your existing firebase.ts

// Supabase Configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Gemini Configuration
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// ✅ Configure PDF.js worker correctly (no CDN, version-safe)
let workerConfigured = false;
function configurePdfWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
}



async function extractTextFromPdf(file: File): Promise<string> {
  configurePdfWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += `\n\n=== Page ${pageNum} ===\n${pageText}`;
  }

  return fullText.trim();
}

async function runGeminiAnalysis(text: string, customPrompt?: string): Promise<string> {
  if (!geminiApiKey) {
    throw new Error("Gemini API key missing. Add VITE_GEMINI_API_KEY to your .env file.");
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt =
    customPrompt?.trim() ||
    `You must output ONLY valid JSON — no markdown, no text before or after.

Analyze the given medical report text and extract structured information as follows:
- Identify all test parameters with their values, units, and reference ranges.
- Normalize parameter names (e.g., "Hb" -> "Hemoglobin").
- Compare each value with its reference range.
- Include ONLY those parameters that are marked as "HIGH" or "LOW" (ignore "NORMAL" ones).

Also extract:
- Report title (e.g., "Kidney Function Test Report")
- Doctor name (if available)
- Report date (if available)

Finally, write a short layman-friendly summary (2–3 sentences) explaining the abnormalities and what they could suggest — use gentle, understandable, and empathetic language. Avoid medical jargon.

Output must be in this exact JSON format:

{
  "report_title": "string",
  "doctor_name": "string",
  "report_date": "string",
  "tests": [
    {
      "parameter": "string",
      "value": "string",
      "unit": "string",
      "reference_range": "string",
      "status": "LOW | HIGH"
    }
  ],
  "summary": "string"
}`;

  const result = await model.generateContent([
    { text: prompt },
    { text: "\n\nDocument Text:\n" + text.substring(0, 60000) },
  ]);
  return result.response.text();
}

interface UploadDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentAdded?: () => void;
}

interface GeminiAnalysis {
  report_title?: string;
  doctor_name?: string;
  report_date?: string;
  tests?: Array<{
    parameter: string;
    value: string;
    unit: string;
    reference_range: string;
    status: "LOW" | "HIGH";
  }>;
  summary?: string;
}

export default function UploadDocumentModal({
  open,
  onOpenChange,
  onDocumentAdded,
}: UploadDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload PDF, JPG, or PNG files only",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      if (!documentTitle) {
        setDocumentTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setAiOutput(null);
    setExtractedText(null);
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a PDF to extract text",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.type !== "application/pdf") {
      toast({
        title: "Unsupported file",
        description: "Text extraction is available for PDF files only",
        variant: "destructive",
      });
      return;
    }
    try {
      setExtractLoading(true);
      setExtractedText(null);
      setUploadProgress("Extracting text from PDF...");
      const text = await extractTextFromPdf(selectedFile);
      setExtractedText(text || "");
      setUploadProgress("");
      toast({
        title: "Extraction successful",
        description: "Text extracted from PDF successfully",
      });
    } catch (err: any) {
      setUploadProgress("");
      toast({
        title: "Extraction failed",
        description: err?.message || "Could not extract text",
        variant: "destructive",
      });
    } finally {
      setExtractLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a PDF to analyze",
        variant: "destructive",
      });
      return;
    }
    if (selectedFile.type !== "application/pdf") {
      toast({
        title: "Unsupported file",
        description: "Gemini analysis is available for PDF files only",
        variant: "destructive",
      });
      return;
    }
    try {
      setAiLoading(true);
      setAiOutput(null);
      setUploadProgress("Extracting text from PDF...");
      const extractedText = await extractTextFromPdf(selectedFile);
      setUploadProgress("Analyzing with Gemini...");
      const analysis = await runGeminiAnalysis(extractedText);
      setAiOutput(analysis);
      setUploadProgress("");
      toast({
        title: "Analysis complete",
        description: "Document analyzed successfully with Gemini AI",
      });
    } catch (err: any) {
      setUploadProgress("");
      toast({
        title: "Analysis failed",
        description: err?.message || "Could not analyze document",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentTitle.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a file and provide a title",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      console.log("=== Document Upload Debug ===");
      console.log("Access Token:", localStorage.getItem("accessToken"));
      console.log("User ID:", localStorage.getItem("userId"));
      console.log("User Role:", localStorage.getItem("userRole"));

      if (!supabase) {
        throw new Error(
          "Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file"
        );
      }

      // Step 0: If PDF, extract text and run Gemini analysis first
      let extractedText: string | undefined;
      let parsedAnalysis: GeminiAnalysis | null = null;

      if (selectedFile.type === "application/pdf") {
        setUploadProgress("Extracting text from PDF...");
        extractedText = await extractTextFromPdf(selectedFile);
        console.log("Extracted text length:", extractedText.length);

        setUploadProgress("Analyzing with Gemini AI...");
        try {
          const aiAnalysis = await runGeminiAnalysis(extractedText);
          console.log("Gemini analysis completed");

          // Parse the JSON response safely
          try {
            // Remove markdown code blocks if present
            let cleanedJson = aiAnalysis.trim();
            if (cleanedJson.startsWith("```json")) {
              cleanedJson = cleanedJson.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
            } else if (cleanedJson.startsWith("```")) {
              cleanedJson = cleanedJson.replace(/```\n?/g, "");
            }
            
            parsedAnalysis = JSON.parse(cleanedJson);
            console.log("Parsed Gemini analysis:", parsedAnalysis);
          } catch (parseErr) {
            console.warn("Invalid JSON from Gemini, storing raw text instead:", parseErr);
            parsedAnalysis = { summary: aiAnalysis } as GeminiAnalysis;
          }
        } catch (aiErr: any) {
          console.error("Gemini analysis failed:", aiErr);
          toast({
            title: "AI Analysis warning",
            description: "AI analysis failed, but upload will continue.",
            variant: "default",
          });
        }
      }

      // Step 1: Upload to Supabase Storage
      setUploadProgress("Uploading file to storage...");
      const userId = localStorage.getItem("userId") || "anonymous";
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${userId}/${timestamp}-${documentTitle.replace(
        /\s+/g,
        "_"
      )}.${fileExt}`;

      console.log("Uploading to Supabase:", {
        fileName,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("medical-documents")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      console.log("Supabase upload successful:", uploadData);

      // Step 2: Get public URL
      const { data: urlData } = supabase.storage
        .from("medical-documents")
        .getPublicUrl(fileName);

      console.log("Public URL generated:", urlData.publicUrl);

      // Step 3: Save to Firestore with properly structured data
      setUploadProgress("Saving document metadata to Firestore...");

      const documentData: any = {
        title: documentTitle,
        fileUrl: urlData.publicUrl,
        fileName: fileName,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        userId: userId,
        uploadedAt: serverTimestamp(),
        createdAt: new Date().toISOString(),
      };

      // Add extracted text if available
      if (extractedText) {
        documentData.extractedText = extractedText;
      }

      // Add AI analysis results if available
      if (parsedAnalysis) {
        documentData.aiAnalysis = {
          reportTitle: parsedAnalysis.report_title || documentTitle,
          doctorName: parsedAnalysis.doctor_name || "Not specified",
          reportDate: parsedAnalysis.report_date || "Not specified",
          tests: parsedAnalysis.tests || [],
          summary: parsedAnalysis.summary || "No summary available",
          processedAt: new Date().toISOString(),
        };

        // Extract anomalies (HIGH/LOW values) for quick access
        if (parsedAnalysis.tests && parsedAnalysis.tests.length > 0) {
          documentData.anomalies = parsedAnalysis.tests.map(
            (test) => `${test.parameter}: ${test.value} ${test.unit} (${test.status})`
          );
          documentData.hasAnomalies = true;
          documentData.anomalyCount = parsedAnalysis.tests.length;
        } else {
          documentData.anomalies = [];
          documentData.hasAnomalies = false;
          documentData.anomalyCount = 0;
        }

        // Add document category based on report title
        const reportTitle = parsedAnalysis.report_title?.toLowerCase() || "";
        if (reportTitle.includes("blood")) {
          documentData.category = "Blood Test";
        } else if (reportTitle.includes("kidney")) {
          documentData.category = "Kidney Function";
        } else if (reportTitle.includes("liver")) {
          documentData.category = "Liver Function";
        } else if (reportTitle.includes("thyroid")) {
          documentData.category = "Thyroid";
        } else if (reportTitle.includes("prescription")) {
          documentData.category = "Prescription";
        } else {
          documentData.category = "General Medical Report";
        }

        documentData.processingStatus = "completed";
      } else {
        documentData.processingStatus = "uploaded_without_analysis";
        documentData.category = "Uncategorized";
      }

      try {
        const docRef = await addDoc(collection(db, "documents"), documentData);
        console.log("Document saved in Firestore with ID:", docRef.id);

        toast({
          title: "Upload successful! 🎉",
          description: parsedAnalysis
            ? `Document analyzed and stored. Found ${documentData.anomalyCount} anomalies.`
            : "Document uploaded successfully.",
        });
      } catch (firestoreErr: any) {
        console.error("Firestore error:", firestoreErr);
        toast({
          title: "Firestore save failed",
          description: firestoreErr.message || "Could not save to Firestore",
          variant: "destructive",
        });
        throw firestoreErr;
      }

      // Reset form
      setSelectedFile(null);
      setDocumentTitle("");
      setAiOutput(null);
      setExtractedText(null);
      setUploadProgress("");
      onOpenChange(false);

      // Refresh documents list
      onDocumentAdded?.();
    } catch (error: any) {
      console.error("=== Upload Error ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);

      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1024px]">
        <DialogHeader>
          <DialogTitle>Upload Medical Document</DialogTitle>
          <DialogDescription>
            Upload your prescription or medical report. Our AI will
            automatically analyze and categorize it for you. (PDF, JPG, PNG -
            Max 10MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Document File *</Label>
            {!selectedFile ? (
              <div className="relative">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
                <Label
                  htmlFor="file"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG (Max 10MB)
                    </p>
                  </div>
                </Label>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="flex-shrink-0"
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Document Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Blood Test Results - Oct 2025"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              disabled={uploading}
            />
          </div>

          {/* Upload Progress */}
          {uploading && uploadProgress && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <p className="text-sm text-blue-900">{uploadProgress}</p>
            </div>
          )}
        </div>

        {/* Extracted Text Preview */}
        {extractedText && (
          <div className="max-h-64 overflow-auto rounded-md border p-3 text-sm bg-muted/40">
            <p className="font-medium mb-2">Extracted Text Preview</p>
            <pre className="whitespace-pre-wrap break-words text-xs">
              {extractedText.substring(0, 1000)}
              {extractedText.length > 1000 && "..."}
            </pre>
          </div>
        )}

        {/* AI Analysis Preview */}
        {aiOutput && (
          <div className="max-h-64 overflow-auto rounded-md border p-3 text-sm bg-muted/40">
            <p className="font-medium mb-2">AI Analysis Preview</p>
            <pre className="whitespace-pre-wrap break-words text-xs">
              {aiOutput}
            </pre>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleExtract}
            disabled={uploading || extractLoading || !selectedFile}
            className="bg-gray-600 hover:bg-gray-500 text-white"
          >
            {extractLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              "Extract Text"
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnalyze}
            disabled={uploading || aiLoading || !selectedFile}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze with AI"
            )}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-[#00BFA5] hover:bg-[#00A892]"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload & Process"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}