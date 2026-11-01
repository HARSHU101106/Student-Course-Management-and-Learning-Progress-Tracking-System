import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TOKEN_KEY, get, post } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let active = true;
    get("/auth/me")
      .then((body) => active && setUser(body.data.user))
      .catch(() => active && clear())
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clear]);

  // Any 401 from the API (expired or revoked token) signs the user out.
  useEffect(() => {
    window.addEventListener("auth:expired", clear);
    return () => window.removeEventListener("auth:expired", clear);
  }, [clear]);

  const login = useCallback(async (email, password) => {
    const body = await post("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, body.data.token);
    setUser(body.data.user);
    return body.data.user;
  }, []);

  const register = useCallback(
    async (form) => {
      await post("/auth/register", form);
      return login(form.email, form.password);
    },
    [login],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout: clear,
      setUser,
    }),
    [user, loading, login, register, clear],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
