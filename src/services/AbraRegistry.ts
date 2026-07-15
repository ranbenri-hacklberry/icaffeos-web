import { RegistryInterface } from '../types/AbraTypes';

// Simple in-memory registry for now. In real app, this loads from abra-manifesto.json
class AbraRegistry implements RegistryInterface {
    private components: Map<string, any> = new Map();

    constructor() {
        // Load manifest logic would go here
    }

    async lookup(componentId: string): Promise<any> {
        return this.components.get(componentId);
    }

    register(id: string, metadata: any) {
        this.components.set(id, metadata);
    }
}

export const abraRegistry = new AbraRegistry();
export default abraRegistry;
