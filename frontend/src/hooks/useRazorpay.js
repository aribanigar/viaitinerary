import { useState } from "react";
import { createRazorpayOrder, verifyRazorpayPayment } from "../api/razorpay";

export const useRazorpay = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const initPayment = async ({
    amount,
    userInfo,
    onSuccess,
    onError,
    token,
  }) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create order on the backend
      const orderResponse = await createRazorpayOrder(amount, token);

      if (!orderResponse || !orderResponse.order_id) {
        throw new Error("Failed to create order");
      }

      const options = {
        key: orderResponse.key,
        amount: orderResponse.amount,
        currency: orderResponse.currency || "INR",
        name: "Viakashmir",
        description: "Subscription Payment",
        order_id: orderResponse.order_id,
        handler: async function (response) {
          // 2. Verify payment on the backend after success
          setLoading(true);
          try {
            const verificationResult = await verifyRazorpayPayment(
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              token,
            );

            if (verificationResult.success) {
              if (onSuccess) onSuccess(verificationResult);
            } else {
              throw new Error(
                verificationResult.message || "Verification failed",
              );
            }
          } catch (err) {
            setError(err.message);
            if (onError) onError(err);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: userInfo?.name || "",
          email: userInfo?.email || "",
          contact: userInfo?.contact || "",
        },
        theme: {
          color: "#3B82F6", // Default blue
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        setError(response.error.description);
        if (onError) onError(response.error);
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      setError(err.message);
      if (onError) onError(err);
      setLoading(false);
    }
  };

  return {
    initPayment,
    loading,
    error,
  };
};
