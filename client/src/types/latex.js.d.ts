declare module "latex.js" {
    export class HtmlGenerator {
        constructor(options?: any);
        stylesAndScripts(basePath: string): HTMLLinkElement[];
        reset(): void;
    }

    export class Generator {
        constructor(generator: any);
    }

    export function parse(latex: string, options?: any): Document;
}
