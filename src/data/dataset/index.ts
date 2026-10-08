import creaturesJson from './creatures.json';
import typesJson from './types.json';
import evolutionsJson from './evolutions.json';
import { buildDataset, type CreatureSpecies, type EvolutionEdge, type TypeMatrix } from '../../core/dataset';

export const dataset = buildDataset(
  creaturesJson as unknown as CreatureSpecies[],
  evolutionsJson as unknown as EvolutionEdge[],
  typesJson as unknown as TypeMatrix,
);
