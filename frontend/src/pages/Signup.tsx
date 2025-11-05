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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Step 1: Account creation schema
const step1Schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(12, "Minimum 12 characters required"),
    confirmPassword: z.string().min(12, "Minimum 12 characters required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Step 2: Role selection schema
const step2Schema = z.object({
  role: z.enum(["PATIENT", "HEALTHCARE_PROVIDER"]),
});

// Step 3: Patient details schema
const step3PatientSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits"),
  bloodGroup: z.enum([
    "O_POSITIVE",
    "O_NEGATIVE",
    "A_POSITIVE",
    "A_NEGATIVE",
    "B_POSITIVE",
    "B_NEGATIVE",
    "AB_POSITIVE",
    "AB_NEGATIVE",
  ]),
  allergies: z.string().optional(),
  chronicConditions: z.string().optional(),
  address: z.string().min(1, "Address required"),
  emergencyContactName: z.string().min(1, "Emergency contact name required"),
  emergencyContactPhone: z.string().min(10, "Valid emergency phone required"),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms",
  }),
  privacyPolicyAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the privacy policy",
  }),
});

// Step 3: Healthcare Provider details schema (temporary)
const step3ProviderSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  phoneNumber: z.string().min(10, "Valid phone number required"),
  specialization: z.string().min(1, "Specialization required"),
  licenseNumber: z.string().min(1, "License number required"),
  hospitalAffiliation: z.string().optional(),
  yearsOfExperience: z.string().min(1, "Years of experience required"),
  address: z.string().min(1, "Address required"),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms",
  }),
  privacyPolicyAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the privacy policy",
  }),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;
type Step3PatientValues = z.infer<typeof step3PatientSchema>;
type Step3ProviderValues = z.infer<typeof step3ProviderSchema>;

export default function Signup() {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Values | null>(null);

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      role: "PATIENT",
    },
  });

  const step3PatientForm = useForm<Step3PatientValues>({
    resolver: zodResolver(step3PatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      dateOfBirth: "",
      gender: "MALE",
      aadhaarNumber: "",
      bloodGroup: "O_POSITIVE",
      allergies: "",
      chronicConditions: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      termsAccepted: false,
      privacyPolicyAccepted: false,
    },
  });

  const step3ProviderForm = useForm<Step3ProviderValues>({
    resolver: zodResolver(step3ProviderSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      specialization: "",
      licenseNumber: "",
      hospitalAffiliation: "",
      yearsOfExperience: "",
      address: "",
      termsAccepted: false,
      privacyPolicyAccepted: false,
    },
  });

  const { toast } = useToast();
  const navigate = useNavigate();

  function onStep1Submit(values: Step1Values) {
    setStep1Data(values);
    setStep(2);
  }

  function onStep2Submit(values: Step2Values) {
    setStep2Data(values);
    setStep(3);
  }

  async function onStep3PatientSubmit(values: Step3PatientValues) {
    if (!step1Data || !step2Data) return;

    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        step1Data.email,
        step1Data.password
      );
      
      const user = userCredential.user;
      
      // Store patient data in Firestore
      await setDoc(doc(db, "patients", user.uid), {
        email: step1Data.email,
        role: step2Data.role,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        aadhaarNumber: values.aadhaarNumber,
        bloodGroup: values.bloodGroup,
        allergies: values.allergies || "",
        chronicConditions: values.chronicConditions || "",
        address: values.address,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      toast({
        title: "Account Created Successfully!",
        description: "Welcome to MedVault. Please sign in to continue.",
      });
      
      navigate("/login");
    } catch (error: any) {
      console.error("Patient registration error:", error);
      
      let errorMessage = "Failed to create account. Please try again.";
      let errorTitle = "Registration Failed";
      
      if (error.code === "auth/email-already-in-use") {
        errorTitle = "Email Already Registered";
        errorMessage = "An account with this email already exists. Please sign in or use a different email.";
        
        // Show toast with action to go to login
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/login")}
            >
              Go to Login
            </Button>
          ),
        });
        
        // Reset to step 1 so user can change email
        setStep(1);
        return;
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  async function onStep3ProviderSubmit(values: Step3ProviderValues) {
    if (!step1Data || !step2Data) return;

    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        step1Data.email,
        step1Data.password
      );
      
      const user = userCredential.user;
      
      // Store healthcare provider data in Firestore
      await setDoc(doc(db, "healthcare_providers", user.uid), {
        email: step1Data.email,
        role: step2Data.role,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        specialization: values.specialization,
        licenseNumber: values.licenseNumber,
        hospitalAffiliation: values.hospitalAffiliation || "",
        yearsOfExperience: values.yearsOfExperience,
        address: values.address,
        verified: false, // Requires admin verification
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      toast({
        title: "Account Created Successfully!",
        description: "Your account is pending verification. You'll be notified once approved.",
      });
      
      navigate("/login");
    } catch (error: any) {
      console.error("Provider registration error:", error);
      
      let errorMessage = "Failed to create account. Please try again.";
      let errorTitle = "Registration Failed";
      
      if (error.code === "auth/email-already-in-use") {
        errorTitle = "Email Already Registered";
        errorMessage = "An account with this email already exists. Please sign in or use a different email.";
        
        // Show toast with action to go to login
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/login")}
            >
              Go to Login
            </Button>
          ),
        });
        
        // Reset to step 1 so user can change email
        setStep(1);
        return;
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === 1
              ? "Create your account"
              : step === 2
              ? "Select your role"
              : "Complete your profile"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <Form {...step1Form}>
              <form
                onSubmit={step1Form.handleSubmit(onStep1Submit)}
                className="space-y-4"
              >
                <FormField
                  control={step1Form.control}
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
                  control={step1Form.control}
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

                <FormField
                  control={step1Form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <FormControl>
                        <Input
                          id="confirmPassword"
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
                  Next
                </Button>
              </form>
            </Form>
          ) : step === 2 ? (
            <Form {...step2Form}>
              <form
                onSubmit={step2Form.handleSubmit(onStep2Submit)}
                className="space-y-6"
              >
                <FormField
                  control={step2Form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-base">
                        I am registering as a:
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="space-y-3"
                        >
                          <label
                            className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                              field.value === "PATIENT"
                                ? "border-primary bg-primary/5"
                                : "border-input hover:border-primary/50"
                            }`}
                          >
                            <RadioGroupItem value="PATIENT" />
                            <div>
                              <p className="font-medium">Patient</p>
                              <p className="text-sm text-muted-foreground">
                                I want to manage my health records and connect
                                with healthcare providers
                              </p>
                            </div>
                          </label>
                          <label
                            className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                              field.value === "HEALTHCARE_PROVIDER"
                                ? "border-primary bg-primary/5"
                                : "border-input hover:border-primary/50"
                            }`}
                          >
                            <RadioGroupItem value="HEALTHCARE_PROVIDER" />
                            <div>
                              <p className="font-medium">Healthcare Provider</p>
                              <p className="text-sm text-muted-foreground">
                                I am a medical professional providing healthcare
                                services
                              </p>
                            </div>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="w-full"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-full">
                    Next
                  </Button>
                </div>
              </form>
            </Form>
          ) : step2Data?.role === "PATIENT" ? (
            <Form {...step3PatientForm}>
              <form
                onSubmit={step3PatientForm.handleSubmit(onStep3PatientSubmit)}
                className="space-y-4"
              >
                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={step3PatientForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          First Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3PatientForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Last Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={step3PatientForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Phone Number{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+919876543210"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3PatientForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Date of Birth{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={step3PatientForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Gender <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MALE">Male</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3PatientForm.control}
                    name="bloodGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Blood Group{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="O_POSITIVE">O+</SelectItem>
                            <SelectItem value="O_NEGATIVE">O-</SelectItem>
                            <SelectItem value="A_POSITIVE">A+</SelectItem>
                            <SelectItem value="A_NEGATIVE">A-</SelectItem>
                            <SelectItem value="B_POSITIVE">B+</SelectItem>
                            <SelectItem value="B_NEGATIVE">B-</SelectItem>
                            <SelectItem value="AB_POSITIVE">AB+</SelectItem>
                            <SelectItem value="AB_NEGATIVE">AB-</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Identity Verification */}
                <FormField
                  control={step3PatientForm.control}
                  name="aadhaarNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Aadhaar Number{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="123456789012"
                          maxLength={12}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Medical Information */}
                <FormField
                  control={step3PatientForm.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allergies (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Peanuts, Penicillin, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={step3PatientForm.control}
                  name="chronicConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chronic Conditions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Diabetes, Hypertension, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contact Information */}
                <FormField
                  control={step3PatientForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Address <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="123 Main Street, City, State, PIN"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={step3PatientForm.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Emergency Contact Name{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3PatientForm.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Emergency Contact Phone{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+919876543210"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Terms and Conditions */}
                <FormField
                  control={step3PatientForm.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I accept the{" "}
                          <a href="/terms" className="text-primary underline">
                            Terms of Service
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={step3PatientForm.control}
                  name="privacyPolicyAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I accept the{" "}
                          <a href="/privacy" className="text-primary underline">
                            Privacy Policy
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="w-full"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-full">
                    Create Account
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...step3ProviderForm}>
              <form
                onSubmit={step3ProviderForm.handleSubmit(onStep3ProviderSubmit)}
                className="space-y-4"
              >
                {/* Personal Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={step3ProviderForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr. Jane" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3ProviderForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={step3ProviderForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+919876543210"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Professional Information */}
                <FormField
                  control={step3ProviderForm.control}
                  name="specialization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialization</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Cardiology, Pediatrics, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={step3ProviderForm.control}
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical License Number</FormLabel>
                        <FormControl>
                          <Input placeholder="MCI-12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step3ProviderForm.control}
                    name="yearsOfExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of Experience</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={step3ProviderForm.control}
                  name="hospitalAffiliation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Hospital/Clinic Affiliation (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="City General Hospital" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contact Information */}
                <FormField
                  control={step3ProviderForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clinic/Practice Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="123 Medical Street, City, State, PIN"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Terms and Conditions */}
                <FormField
                  control={step3ProviderForm.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I accept the{" "}
                          <a href="/terms" className="text-primary underline">
                            Terms of Service
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={step3ProviderForm.control}
                  name="privacyPolicyAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I accept the{" "}
                          <a href="/privacy" className="text-primary underline">
                            Privacy Policy
                          </a>
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="w-full"
                  >
                    Back
                  </Button>
                  <Button type="submit" className="w-full">
                    Create Account
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
