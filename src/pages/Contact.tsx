import { FormEvent, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Mail, MessageSquare, User, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import EducatorLayout from "@/components/EducatorLayout";

const INQUIRY_TYPES = [
  "General question",
  "School / Team plan",
  "Bug report",
  "Feature request",
  "Other",
];

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inquiryType, setInquiryType] = useState(INQUIRY_TYPES[0]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error: dbError } = await (supabase as any)
      .from("contact_messages")
      .insert({ name: name.trim(), email: email.trim(), inquiry_type: inquiryType, message: message.trim() });

    setIsLoading(false);

    if (dbError) {
      setError("Something went wrong. Please try again or email us directly at hello@gogodeep.com");
      return;
    }

    setSubmitted(true);
  };

  return (
    <EducatorLayout title="Contact" noSidebar>
      <Helmet>
        <title>Contact</title>
        <meta name="description" content="Get in touch with the Gogodeep team. Questions about the AI study tool for STEM students, school and team plans, or partnerships." />
        <link rel="canonical" href="https://gogodeep.com/contact" />
      </Helmet>
      <div className="max-w-xl mx-auto">

            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Contact</p>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground">Get in touch</h1>
              <p className="mt-4 text-base text-muted-foreground">
                Whether it's a question, a bug, or anything else, we read every message and act on it.
              </p>
            </div>

            <Card className="border border-border bg-card p-8">
              {submitted ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Message received</h2>
                  <p className="text-sm text-muted-foreground">
                    We'll get back to you at <span className="font-medium text-foreground">{email}</span> as soon as possible.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2 border-border"
                    onClick={() => { setSubmitted(false); setName(""); setEmail(""); setMessage(""); setInquiryType(INQUIRY_TYPES[0]); }}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="border-border bg-secondary pl-9"
                        placeholder="Your name"
                        maxLength={80}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="border-border bg-secondary pl-9"
                        placeholder="name@example.com"
                        maxLength={254}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Inquiry type</label>
                    <select
                      value={inquiryType}
                      onChange={(e) => setInquiryType(e.target.value)}
                      className="w-full rounded-md border border-border bg-secondary py-2 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {INQUIRY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Message</label>
                    <div className="relative">
                      <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        required
                        maxLength={2000}
                        placeholder="Tell us what's on your mind…"
                        className="w-full rounded-md border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      {message.length > 1500 && (
                        <span className={`pointer-events-none absolute bottom-2 right-2 text-[10px] ${message.length >= 2000 ? "text-amber-500" : "text-muted-foreground/50"}`}>{message.length}/2000</span>
                      )}
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                  )}

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />Sending…</span>
                    ) : (
                      <span className="flex items-center gap-2"><Send className="h-4 w-4" />Send message</span>
                    )}
                  </Button>
                </form>
              )}
            </Card>

      </div>
    </EducatorLayout>
  );
};

export default Contact;
