import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth" ;

// Login schema
const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// MFA verification schema
const mfaSchema = z.object({
  mfaCode: z.string().length(6, "MFA code must be 6 digits"),
});

type MFAFormValues = z.infer<typeof mfaSchema>;

const LoginPage = () => {
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const mfaForm = useForm<MFAFormValues>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      mfaCode: "",
    },
  });

  function generateDeviceFingerprint(): string {
    try {
      const ua = navigator.userAgent;
      const lang = navigator.language;
      const plat = (navigator as any).platform || "unknown";
      return btoa([ua, lang, plat].join("|")).slice(0, 64);
    } catch {
      return "unknown-device";
    }
  }

  function getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  }

  async function handleLogin(values: LoginFormValues) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      
      const user = userCredential.user;
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.email}!`,
      });
      
      // Store user info in localStorage
      localStorage.setItem("userId", user.uid);
      localStorage.setItem("userEmail", user.email || "");
      
      // Navigate to patient dashboard (you can customize based on user role)
      navigate("/patient/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      
      let errorMessage = "Failed to sign in. Please check your credentials.";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  async function handleMFAVerification(values: MFAFormValues) {
    // TODO: Implement Firebase MFA verification if needed
    toast({
      title: "Not Implemented",
      description: "Please implement Firebase MFA",
      variant: "destructive",
    });
    
    console.log("MFA verification attempt:", values.mfaCode);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {mfaRequired ? "Enter MFA Code" : "Sign in to MedVault"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!mfaRequired ? (
            <Form {...loginForm}>
              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-4"
              >
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="email">Email</Label>
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="password">Password</Label>
                      <FormControl>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...mfaForm}>
              <form
                onSubmit={mfaForm.handleSubmit(handleMFAVerification)}
                className="space-y-4"
              >
                <FormField
                  control={mfaForm.control}
                  name="mfaCode"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="mfaCode">6-Digit Code</Label>
                      <FormControl>
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full">
                  Verify MFA
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
