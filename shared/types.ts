export interface Policy { extension: string; kind: 'fixed' | 'custom'; blocked: boolean }
export interface Policies { fixed: Policy[]; custom: Policy[]; customCount: number; limits: { custom: number; file: number; body: number; queue: number } }
