// Razorpay Checkout for the public proposal page. The script is loaded once
// (and reused if the subscription page already added it); `openRazorpay`
// resolves with the checkout's success response, or rejects with
// `{ dismissed: true, failed?: string }` when the client closes the window.
const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const fail = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    const existing = document.querySelector(`script[src="${SRC}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => (window.Razorpay ? resolve(window.Razorpay) : fail()));
    script.addEventListener("error", fail);
    if (!existing) {
      script.src = SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
  return scriptPromise;
}

export async function openRazorpay(options) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    let settled = false;
    let failed = "";
    const rzp = new Razorpay({
      ...options,
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ...(options.modal || {}),
        ondismiss: () => {
          if (settled) return;
          settled = true;
          const err = new Error(failed || "Payment window closed");
          err.dismissed = true;
          err.failed = failed;
          reject(err);
        },
      },
    });
    // Checkout shows the failure itself and lets the client retry; remember
    // it so a later dismiss can say what happened.
    rzp.on("payment.failed", (resp) => {
      failed = resp?.error?.description || "The payment didn't go through.";
    });
    rzp.open();
  });
}
