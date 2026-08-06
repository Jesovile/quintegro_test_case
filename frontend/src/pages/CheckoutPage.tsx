import React, { useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  LockKeyhole,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PROCESS_PAYMENT } from "../graphql/mutations";
import { GET_ORDER } from "../graphql/queries";

interface CheckoutRouteParams {
  orderId: string;
}

type CheckoutStep = "delivery" | "payment";

const streetSuggestions = [
  "Main Street",
  "Market Street",
  "Park Avenue",
  "Oak Street",
  "High Street",
];

const getFieldClassName = (isValid: boolean, showValidation: boolean) =>
  cn(
    showValidation &&
      isValid &&
      "border-green-500 focus-visible:ring-green-500",
    showValidation && !isValid && "border-red-400 focus-visible:ring-red-400",
  );

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<CheckoutRouteParams>();
  const apolloClient = useApolloClient();
  const { data, loading, error } = useQuery(GET_ORDER, {
    variables: { orderId },
  });
  const [processPayment] = useMutation(PROCESS_PAYMENT);
  const [activeStep, setActiveStep] = useState<CheckoutStep>("delivery");
  const [deliverySubmitted, setDeliverySubmitted] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [paypalSubmitted, setPaypalSubmitted] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [processingMethod, setProcessingMethod] = useState<
    "card" | "paypal" | null
  >(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [delivery, setDelivery] = useState({
    postalCode: "",
    street: "",
    city: "",
  });
  const [payment, setPayment] = useState({
    cardNumber: "",
    cardholderName: "",
    expiryDate: "",
    cvv: "",
  });

  const deliveryValidation = {
    postalCode: delivery.postalCode.trim().length >= 3,
    street: delivery.street.trim().length >= 3,
    city: delivery.city.trim().length >= 2,
  };
  const deliveryComplete = Object.values(deliveryValidation).every(Boolean);

  const paymentValidation = {
    cardNumber: payment.cardNumber.replace(/\D/g, "").length === 16,
    cardholderName: payment.cardholderName.trim().length >= 2,
    expiryDate: /^(0[1-9]|1[0-2])\/\d{2}$/.test(payment.expiryDate),
    cvv: /^\d{3,4}$/.test(payment.cvv),
  };
  const cardFormValid = Object.values(paymentValidation).every(Boolean);
  const paypalEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    paypalEmail.trim(),
  );
  const paymentComplete = paymentSucceeded;

  const handleDeliverySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeliverySubmitted(true);

    if (deliveryComplete) {
      setActiveStep("payment");
    }
  };

  const submitPayment = async (method: "card" | "paypal") => {
    setProcessingMethod(method);
    setPaymentError(null);

    try {
      const paymentInput =
        method === "card"
          ? {
              method,
              cardNumber: payment.cardNumber,
              cardholderName: payment.cardholderName,
              expiryDate: payment.expiryDate,
              cvv: payment.cvv,
            }
          : {
              method,
              paypalEmail: paypalEmail.trim(),
            };

      const result = await processPayment({
        variables: {
          orderId,
          input: {
            delivery,
            payment: paymentInput,
          },
        },
      });
      const response = result.data?.processPayment;

      if (!response?.success) {
        throw new Error(response?.error || "Payment validation failed.");
      }

      apolloClient.cache.evict({ fieldName: "orders" });
      apolloClient.cache.evict({ fieldName: "order", args: { orderId } });
      apolloClient.cache.gc();
      setPaymentSucceeded(true);
    } catch (error) {
      console.error("Failed to process payment:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Payment validation failed.",
      );
    } finally {
      setProcessingMethod(null);
    }
  };

  const handlePaymentSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPaymentSubmitted(true);

    if (cardFormValid) {
      await submitPayment("card");
    }
  };

  const handlePaypalSubmit = async () => {
    setPaypalSubmitted(true);

    if (paypalEmailValid) {
      await submitPayment("paypal");
    }
  };

  const handleCardNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
    setPayment((current) => ({ ...current, cardNumber: formatted }));
  };

  const handleExpiryChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setPayment((current) => ({ ...current, expiryDate: formatted }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Checking order...</p>
        </div>
      </div>
    );
  }

  const order = data?.order;
  const canProcessPayment =
    order?.status === "submited" || order?.status === "waiting_payment";

  if (error || !order || !canProcessPayment) {
    const message = error
      ? error.message
      : !order
        ? "Order not found."
        : "This order is not waiting for payment.";

    return (
      <Card className="mx-auto max-w-2xl border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
            <div>
              <h1 className="font-semibold">Checkout is unavailable</h1>
              <p className="mt-1 text-sm">{message}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/order">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to orders
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (paymentSucceeded) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-gray-500">Order #{orderId}</p>
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
          </div>
          <Badge
            variant="outline"
            className="border-green-200 bg-green-50 text-green-800"
          >
            Payment completed
          </Badge>
        </div>

        <Card className="border-green-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center p-8 text-center sm:p-12">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-11 w-11" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Payment successful
            </h2>
            <p className="mt-3 max-w-md text-gray-600">
              Your payment for order #{orderId} was confirmed successfully.
            </p>
            <Button
              asChild
              className="mt-8 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Link to="/">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Continue shopping
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" className="mb-6">
        <Link to="/order">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to orders
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-gray-500">Order #{orderId}</p>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-800"
        >
          Waiting for payment
        </Badge>
      </div>

      <div
        className="mb-8 flex items-center px-4"
        aria-label="Checkout progress"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold",
              deliveryComplete
                ? "border-green-500 bg-green-500 text-white"
                : "border-blue-600 bg-blue-600 text-white",
            )}
          >
            {deliveryComplete ? <Check className="h-5 w-5" /> : "1"}
          </div>
          <span className="hidden text-sm font-medium text-gray-700 sm:inline">
            Delivery
          </span>
        </div>
        <div
          className={cn(
            "mx-4 h-1 flex-1 rounded-full bg-gray-200 transition-colors",
            deliveryComplete && "bg-green-500",
          )}
        />
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold",
              paymentComplete
                ? "border-green-500 bg-green-500 text-white"
                : activeStep === "payment"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-500",
            )}
          >
            {paymentComplete ? <Check className="h-5 w-5" /> : "2"}
          </div>
          <span className="hidden text-sm font-medium text-gray-700 sm:inline">
            Payment
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <Card
          className={cn(
            "overflow-hidden border-gray-200 bg-white shadow-sm",
            deliveryComplete && "border-green-300",
          )}
        >
          <button
            type="button"
            onClick={() => setActiveStep("delivery")}
            className="flex w-full items-center gap-4 p-6 text-left"
            aria-expanded={activeStep === "delivery"}
          >
            <div
              className={cn(
                "rounded-full p-3",
                deliveryComplete
                  ? "bg-green-50 text-green-600"
                  : "bg-blue-50 text-blue-600",
              )}
            >
              {deliveryComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Delivery address</h2>
              <p className="mt-1 text-sm text-gray-600">
                {deliveryComplete
                  ? `${delivery.street}, ${delivery.city}`
                  : "Enter the address for your order."}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-gray-400 transition-transform",
                activeStep === "delivery" && "rotate-180",
              )}
            />
          </button>

          {activeStep === "delivery" && (
            <CardContent className="border-t border-gray-200 p-6">
              <form
                className="space-y-5"
                onSubmit={handleDeliverySubmit}
                noValidate
              >
                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="street"
                      className="text-sm font-medium text-gray-700"
                    >
                      Street address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="street"
                      list="street-suggestions"
                      value={delivery.street}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          street: event.target.value,
                        }))
                      }
                      placeholder="Start typing a street"
                      autoComplete="street-address"
                      className={getFieldClassName(
                        deliveryValidation.street,
                        deliverySubmitted,
                      )}
                    />
                    <datalist id="street-suggestions">
                      {streetSuggestions.map((street) => (
                        <option key={street} value={street} />
                      ))}
                    </datalist>
                    {deliverySubmitted && !deliveryValidation.street && (
                      <p className="text-xs text-red-600">
                        Enter a street address.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="postal-code"
                      className="text-sm font-medium text-gray-700"
                    >
                      Postal code <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="postal-code"
                      value={delivery.postalCode}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          postalCode: event.target.value,
                        }))
                      }
                      placeholder="00-001"
                      autoComplete="postal-code"
                      className={getFieldClassName(
                        deliveryValidation.postalCode,
                        deliverySubmitted,
                      )}
                    />
                    {deliverySubmitted && !deliveryValidation.postalCode && (
                      <p className="text-xs text-red-600">
                        Enter a valid postal code.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="city"
                      className="text-sm font-medium text-gray-700"
                    >
                      City <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="city"
                      value={delivery.city}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                      placeholder="Warsaw"
                      autoComplete="address-level2"
                      className={getFieldClassName(
                        deliveryValidation.city,
                        deliverySubmitted,
                      )}
                    />
                    {deliverySubmitted && !deliveryValidation.city && (
                      <p className="text-xs text-red-600">Enter a city.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Continue to payment
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        <Card
          className={cn(
            "overflow-hidden border-gray-200 bg-white shadow-sm",
            paymentComplete && "border-green-300",
          )}
        >
          <button
            type="button"
            onClick={() => deliveryComplete && setActiveStep("payment")}
            disabled={!deliveryComplete}
            className="flex w-full items-center gap-4 p-6 text-left disabled:cursor-not-allowed disabled:opacity-60"
            aria-expanded={activeStep === "payment"}
          >
            <div
              className={cn(
                "rounded-full p-3",
                paymentComplete
                  ? "bg-green-50 text-green-600"
                  : "bg-blue-50 text-blue-600",
              )}
            >
              {paymentComplete ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Payment</h2>
              <p className="mt-1 text-sm text-gray-600">
                {paymentComplete
                  ? "Payment details are ready."
                  : "Pay securely by card or PayPal."}
              </p>
            </div>
            {!deliveryComplete ? (
              <LockKeyhole className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-gray-400 transition-transform",
                  activeStep === "payment" && "rotate-180",
                )}
              />
            )}
          </button>

          {activeStep === "payment" && deliveryComplete && (
            <CardContent className="border-t border-gray-200 p-6">
              <form
                className="space-y-5"
                onSubmit={handlePaymentSubmit}
                noValidate
              >
                <div className="space-y-2">
                  <label
                    htmlFor="card-number"
                    className="text-sm font-medium text-gray-700"
                  >
                    Card number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="card-number"
                    value={payment.cardNumber}
                    onChange={(event) =>
                      handleCardNumberChange(event.target.value)
                    }
                    placeholder="4242 4242 4242 4242"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    className={getFieldClassName(
                      paymentValidation.cardNumber,
                      paymentSubmitted,
                    )}
                  />
                  {paymentSubmitted && !paymentValidation.cardNumber && (
                    <p className="text-xs text-red-600">
                      Enter a 16-digit card number.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="cardholder-name"
                    className="text-sm font-medium text-gray-700"
                  >
                    Name on card <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="cardholder-name"
                    value={payment.cardholderName}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        cardholderName: event.target.value,
                      }))
                    }
                    placeholder="JOHN DOE"
                    autoComplete="cc-name"
                    className={getFieldClassName(
                      paymentValidation.cardholderName,
                      paymentSubmitted,
                    )}
                  />
                  {paymentSubmitted && !paymentValidation.cardholderName && (
                    <p className="text-xs text-red-600">
                      Enter the cardholder name.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="expiry-date"
                      className="text-sm font-medium text-gray-700"
                    >
                      Expiry date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="expiry-date"
                      value={payment.expiryDate}
                      onChange={(event) =>
                        handleExpiryChange(event.target.value)
                      }
                      placeholder="MM/YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      className={getFieldClassName(
                        paymentValidation.expiryDate,
                        paymentSubmitted,
                      )}
                    />
                    {paymentSubmitted && !paymentValidation.expiryDate && (
                      <p className="text-xs text-red-600">Use MM/YY format.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="cvv"
                      className="text-sm font-medium text-gray-700"
                    >
                      CVV <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="cvv"
                      type="password"
                      value={payment.cvv}
                      onChange={(event) =>
                        setPayment((current) => ({
                          ...current,
                          cvv: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4),
                        }))
                      }
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      className={getFieldClassName(
                        paymentValidation.cvv,
                        paymentSubmitted,
                      )}
                    />
                    {paymentSubmitted && !paymentValidation.cvv && (
                      <p className="text-xs text-red-600">
                        Enter a 3 or 4-digit CVV.
                      </p>
                    )}
                  </div>
                </div>

                {paymentError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                    {paymentError}
                  </div>
                )}

                {paymentComplete && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    Payment details were validated successfully.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={processingMethod !== null || paymentSucceeded}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {processingMethod === "card" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {processingMethod === "card"
                    ? "Processing..."
                    : "Process payment"}
                </Button>

                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs uppercase tracking-wide text-gray-400">
                    or
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="paypal-email"
                    className="text-sm font-medium text-gray-700"
                  >
                    PayPal email
                  </label>
                  <Input
                    id="paypal-email"
                    type="email"
                    value={paypalEmail}
                    onChange={(event) => setPaypalEmail(event.target.value)}
                    placeholder="john@example.com"
                    autoComplete="email"
                    className={getFieldClassName(
                      paypalEmailValid,
                      paypalSubmitted,
                    )}
                  />
                  {paypalSubmitted && !paypalEmailValid && (
                    <p className="text-xs text-red-600">
                      Enter a valid PayPal email.
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePaypalSubmit}
                  disabled={processingMethod !== null || paymentSucceeded}
                  className="w-full border-blue-300 bg-[#ffc439] font-bold text-[#003087] hover:bg-[#f2ba36]"
                >
                  {processingMethod === "paypal" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {processingMethod === "paypal" ? "Processing..." : "PayPal"}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CheckoutPage;
