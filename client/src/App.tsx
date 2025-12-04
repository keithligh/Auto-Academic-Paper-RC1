/*
 * GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file.
 */
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import LandingPage from "@/pages/LandingPage";
import ProcessingPage from "@/pages/ProcessingPage";
import ResultPage from "@/pages/ResultPage";
import NotFound from "@/pages/not-found";

function Router() {
    return (
        <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/processing/:id" component={ProcessingPage} />
            <Route path="/results/:id" component={ResultPage} />
            <Route component={NotFound} />
        </Switch>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router />
            <Toaster />
        </QueryClientProvider>
    );
}

export default App;
