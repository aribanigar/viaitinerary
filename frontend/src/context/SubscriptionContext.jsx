import React, { createContext, useContext, useState } from "react";

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [targetMember, setTargetMember] = useState(null);

  const setSubscriptionTarget = (member) => {
    setTargetMember(member);
  };

  const clearSubscriptionTarget = () => {
    setTargetMember(null);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        targetMember,
        setSubscriptionTarget,
        clearSubscriptionTarget,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider",
    );
  }
  return context;
};
