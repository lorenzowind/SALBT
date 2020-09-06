import Laboratory from '../infra/typeorm/entities/Laboratory';

import ICreateLaboratoryDTO from '../dtos/ICreateOrUpdateLaboratoryDTO';

export default interface ILaboratoriesRepository {
  findAllLaboratories(search: string, page: number): Promise<Laboratory[]>;
  findById(id: string): Promise<Laboratory | undefined>;
  findByName(name: string): Promise<Laboratory | undefined>;
  create(data: ICreateLaboratoryDTO): Promise<Laboratory>;
  save(laboratory: Laboratory): Promise<Laboratory>;
  remove(laboratory: Laboratory): Promise<void>;
}
