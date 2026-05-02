import React from 'react';

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

export const useSafeAreaInsets = () => insets;
export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SafeAreaView = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SafeAreaConsumer = ({ children }: { children: (insets: typeof insets) => React.ReactNode }) => <>{children(insets)}</>;
export const initialWindowMetrics = { insets, frame: { x: 0, y: 0, width: 390, height: 844 } };
