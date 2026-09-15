import { api, session, setSession } from "../api.js";
import { $, busy, toast } from "../ui.js";

const redirect = user => {
  const destination = user?.role === "ADMIN" ? "admin/dashboard.html" : "app/dashboard.html";
  window.location.href = destination;
};

if (session()?.user) redirect(session().user);

$("#login-form").onsubmit = event => {
  event.preventDefault();

  busy($("#login"), async () => {
    const username = $("#username").value.trim();
    const password = $("#password").value;

    if (!username) {
      $("#username").focus();
      throw new Error("Please enter your username.");
    }
    if (!password) {
      $("#password").focus();
      throw new Error("Please enter your password.");
    }

    const result = await api.login(username, password);
    setSession(result);
    toast("Signed in successfully.", "ok");
    redirect(result.user);
  });
};

$("#toggle-password").onclick = () => {
  const input = $("#password");
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  $("#toggle-password").textContent = visible ? "Show" : "Hide";
  $("#toggle-password").setAttribute(
    "aria-label",
    visible ? "Show password" : "Hide password"
  );
};

$("#forgot").onclick = () => {
  toast("Password reset will be connected to the backend later.", "info");
};
