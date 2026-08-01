import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthenticationConfigurationError } from "@application/auth";
import { useAuth } from "./AuthContext";
import { Button, ErrorAlert } from "@shared/ui";

const loginFormSchema = z.object({
  username: z.string().trim().min(1, "Ingresar usuario."),
  password: z.string().min(1, "Ingresar contrasena.")
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export interface LoginPageProps {
  mapError(this: void, error: unknown): { message: string };
}

export function LoginPage({ mapError }: LoginPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const redirectTo = useMemo(
    () => sanitizeRedirect(searchParams.get("redirectTo")),
    [searchParams]
  );
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  useEffect(() => {
    if (!auth.isConfigurationValid) {
      setFormError(mapError(new AuthenticationConfigurationError()).message);
    }
  }, [auth.isConfigurationValid, mapError]);

  if (auth.isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);

    try {
      await auth.login(values);
      resetField("password");
      void navigate(redirectTo, { replace: true });
    } catch (error) {
      resetField("password");
      setFormError(mapError(error).message);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <LockKeyhole aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Acceso local
            </p>
            <h1 className="text-xl font-semibold">Registro domestico</h1>
          </div>
        </div>

        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event);
          }}
        >
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              autoComplete="username"
              aria-invalid={errors.username ? "true" : "false"}
              aria-describedby={
                errors.username ? "username-error" : undefined
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              {...register("username")}
            />
            {errors.username ? (
              <p id="username-error" className="text-sm text-destructive">
                {errors.username.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="password">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={
                errors.password ? "password-error" : undefined
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              {...register("password")}
            />
            {errors.password ? (
              <p id="password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {formError ? <ErrorAlert message={formError} /> : null}

          <Button
            className="w-full"
            disabled={isSubmitting || !auth.isConfigurationValid}
            type="submit"
          >
            Ingresar
          </Button>
        </form>
      </section>
    </main>
  );
}

function sanitizeRedirect(value: string | null) {
  if (value === null || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
