import "@rainbow-me/rainbowkit/styles.css";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "./config/wagmi";
import { FHEVMProvider } from "./hooks/useFHEVM";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>
        <FHEVMProvider>
          <App />
        </FHEVMProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

