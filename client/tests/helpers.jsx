import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../src/context/AuthContext.jsx";

export function renderWithRouter(ui, { route = "/", wrap = true } = {}) {
  const tree = wrap ? <AuthProvider>{ui}</AuthProvider> : ui;
  return render(<MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>);
}
