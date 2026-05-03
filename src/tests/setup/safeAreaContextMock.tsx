import React from 'react';

type Insets = { top: number; bottom: number; left: number; right: number };

const insets: Insets = { top: 0, bottom: 0, left: 0, right: 0 };

export const useSafeAreaInsets = () => insets;
export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SafeAreaView = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SafeAreaConsumer = ({ children }: { children: (insets: Insets) => React.ReactNode }) => <>{children(insets)}</>;
export const initialWindowMetrics = { insets, frame: { x: 0, y: 0, width: 390, height: 844 } };
