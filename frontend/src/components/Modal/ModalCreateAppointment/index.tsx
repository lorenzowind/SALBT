import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  FiActivity,
  FiBook,
  FiBookmark,
  FiClock,
  FiCpu,
  FiUser,
} from 'react-icons/fi';
import { FormHandles } from '@unform/core';
import * as Yup from 'yup';
import moment from 'moment';

import api from '../../../services/api';

import { useToast } from '../../../hooks/toast';
import { useAuth, User } from '../../../hooks/auth';
import { useSubjects } from '../../../hooks/subjects';
import { useSchedules } from '../../../hooks/schedules';
import { useClassrooms } from '../../../hooks/classrooms';
import { useLaboratories } from '../../../hooks/laboratories';

import getValidationErrors from '../../../utils/getValidationErrors';

import Modal from '..';
import { getStatus } from '../ModalAppointmentInfo';
import Select from '../../Select';
import Button from '../../Button';
import DateInput from '../../DateInput';
import Loading from '../../Loading';
import Textarea from '../../Textarea';

import { Form, CloseModal } from './styles';

interface ICreateAppointmentData {
  teacher_id: string;
  laboratory_number: string;
  time: string;
  year: number;
  month: number;
  day: number;
  subject: string;
  classroom: string;
  status: 'scheduled' | 'presence' | 'absence' | 'non-scheduled' | '0';
  observations: string;
}

interface IModalProps {
  isOpen: boolean;
  selectedLaboratory: number;
  selectedDate: Date;
  setIsOpen: () => void;
  setToRefresh: React.Dispatch<React.SetStateAction<boolean>>;
}

const ModalCreateAppointment: React.FC<IModalProps> = ({
  isOpen,
  selectedLaboratory,
  selectedDate,
  setIsOpen,
  setToRefresh,
}) => {
  const formRef = useRef<FormHandles>(null);

  const { addToast } = useToast();
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { schedules } = useSchedules();
  const { classrooms } = useClassrooms();
  const { laboratories } = useLaboratories();

  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(selectedDate);

  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const [laboratoriesArray, setLaboratoriesArray] = useState(laboratories);
  const [classroomsArray, setClassroomsArray] = useState(classrooms);
  const [schedulesArray, setSchedulesArray] = useState(schedules);
  const [subjectsArray, setSubjectsArray] = useState(
    user.subjects ? user.subjects.split(', ') : subjects,
  );

  const [teachersSelect, setTeachersSelect] = useState<User[]>([]);

  useEffect(() => {
    if (subjects && !user.subjects) {
      setSubjectsArray(subjects);
    }
  }, [subjects, user.subjects]);

  useEffect(() => {
    if (laboratories) {
      setLaboratoriesArray(
        laboratories.filter(laboratory => laboratory.classroomNumber !== 0),
      );
    }
  }, [laboratories]);

  useEffect(() => {
    if (classrooms) {
      setClassroomsArray(classrooms);
    }
  }, [classrooms]);

  useEffect(() => {
    if (schedules) {
      setSchedulesArray(schedules);
    }
  }, [schedules]);

  const getLaboratoryName = useCallback(
    (laboratory_number: number) => {
      const laboratory = laboratories.find(
        findLaboratory => findLaboratory.classroomNumber === laboratory_number,
      );

      if (laboratory) {
        return laboratory.name;
      }

      return '';
    },
    [laboratories],
  );

  const getScheduleName = useCallback(
    (time: string) => {
      const schedule = schedules.find(
        findTime => findTime.schedule_begin + findTime.schedule_end === time,
      );

      if (schedule) {
        return schedule.schedule_name;
      }

      return '';
    },
    [schedules],
  );

  const handleSubmit = useCallback(
    async (data: ICreateAppointmentData) => {
      try {
        formRef.current?.setErrors({});

        const schema1 = Yup.object().shape({
          laboratory_number: Yup.mixed().test(
            'match',
            'Laboratório é obrigatório',
            () => {
              return data.laboratory_number !== '0';
            },
          ),
          time: Yup.mixed().test('match', 'Tempo de aula é obrigatório', () => {
            return data.time !== '0';
          }),
          subject: Yup.mixed().test('match', 'Disciplina é obrigatória', () => {
            return data.subject !== '0';
          }),
          classroom: Yup.mixed().test('match', 'Turma é obrigatória', () => {
            return data.classroom !== '0';
          }),
        });

        await schema1.validate(data, {
          abortEarly: false,
        });

        if (user.position === 'admin') {
          const schema2 = Yup.object().shape({
            teacher_id: Yup.mixed().test(
              'match',
              'Professor(a) é obrigatório',
              () => {
                return data.teacher_id !== '0';
              },
            ),
            status: Yup.mixed().test('match', 'Status é obrigatório', () => {
              return data.status !== '0';
            }),
          });

          await schema2.validate(data, {
            abortEarly: false,
          });
        }

        const checkDate = moment().diff(date, 'days');

        if (checkDate <= -14 || date.getDay() === 6 || date.getDay() === 0) {
          throw new Error();
        }

        const appointmentData = {
          laboratory_number: Number(data.laboratory_number),
          time: data.time,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          subject: data.subject,
          classroom: data.classroom,
          status: user.position === 'admin' ? data.status : 'scheduled',
          observations: data.observations ? data.observations : '',
        };

        const requestExtension = {};

        if (user.position === 'admin') {
          Object.assign(requestExtension, {
            params: {
              teacher_id: data.teacher_id,
            },
          });
        }

        setLoading(true);

        await api
          .post('appointments', appointmentData, requestExtension)
          .then(async () => {
            addToast({
              type: 'success',
              title: 'Agendamento criado com sucesso',
              description: `Agendamento criado para o dia ${date.toLocaleDateString()} no laboratório ${Number(
                data.laboratory_number,
              )}.`,
            });

            if (user.position === 'admin') {
              await api.post('notifications', {
                type: 'schedules',
                description: `Um agendamento para o dia ${new Date(
                  appointmentData.year,
                  appointmentData.month - 1,
                  appointmentData.day,
                ).toLocaleDateString()}, ${getScheduleName(
                  appointmentData.time,
                )}, no laboratório ${getLaboratoryName(
                  appointmentData.laboratory_number,
                )}, foi criado com o status de ${getStatus({
                  status: data.status,
                })}.`,
                recipient_user_id: data.teacher_id,
              });
            }

            setIsOpen();
            setToRefresh(true);
          });
      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const errors = getValidationErrors(err);

          formRef.current?.setErrors(errors);

          return;
        }

        addToast({
          type: 'error',
          title: 'Erro na criação de agendamento',
          description: `Verifique ${
            user.position === 'admin'
              ? 'se a disciplina selecionada corresponde ao professor,'
              : ''
          } se a data é válida ou se não há um agendamento existente no mesmo horário.`,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      user,
      date,
      addToast,
      setIsOpen,
      setToRefresh,
      getScheduleName,
      getLaboratoryName,
    ],
  );

  useEffect(() => {
    const loadTeachers = async () => {
      setLoading(true);
      try {
        await api.get<User[]>('users/all').then(response => {
          setTeachersSelect(
            response.data.filter(teacher => teacher.position !== 'admin'),
          );
        });
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Erro na busca por professores',
        });
      } finally {
        setLoading(false);
      }
    };

    if (user.position === 'admin') {
      loadTeachers();
    }
  }, [addToast, user.position]);

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const selectedTeacher = teachersSelect.find(
      teacher => teacher.id === selectedTeacherId,
    );

    if (selectedTeacher && selectedTeacher.subjects) {
      setSubjectsArray(
        subjects.filter(subject =>
          selectedTeacher.subjects.split(', ').includes(subject),
        ),
      );
    }
  }, [selectedTeacherId, subjects, teachersSelect]);

  return (
    <>
      {loading && <Loading zIndex={1} />}

      <Modal isOpen={isOpen} setIsOpen={setIsOpen}>
        <CloseModal onClick={setIsOpen}>
          <strong>X</strong>
        </CloseModal>

        <Form ref={formRef} onSubmit={handleSubmit}>
          <header>
            <h1>Agendar laboratório</h1>
            <nav>
              <DateInput
                date={date}
                setDate={(value: Date) => setDate(value)}
              />
            </nav>
          </header>
          <div>
            <section>
              {user.position === 'admin' && (
                <>
                  <strong>Professor(a)</strong>
                  <Select
                    icon={FiUser}
                    name="teacher_id"
                    defaultValue="0"
                    onChange={e => setSelectedTeacherId(e.target.value)}
                  >
                    <option value="0" disabled>
                      Selecione professor(a)
                    </option>
                    {teachersSelect.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </Select>
                </>
              )}

              <strong>Laboratório</strong>
              <Select
                icon={FiCpu}
                name="laboratory_number"
                defaultValue={selectedLaboratory}
              >
                <option value="0" disabled>
                  Selecione laboratório
                </option>
                {laboratoriesArray.map(laboratory => (
                  <option
                    key={laboratory.positionNumber}
                    value={laboratory.classroomNumber}
                  >
                    {laboratory.name}
                  </option>
                ))}
              </Select>

              <strong>Turma</strong>
              <Select icon={FiBookmark} name="classroom" defaultValue="0">
                <option value="0" disabled>
                  Selecione turma
                </option>
                {classroomsArray.map(classroom => (
                  <option key={classroom} value={classroom}>
                    {classroom}
                  </option>
                ))}
              </Select>
            </section>
            <section>
              {user.position === 'admin' && (
                <>
                  <strong>Status</strong>
                  <Select icon={FiActivity} name="status" defaultValue="0">
                    <option value="0" disabled>
                      Selecione status
                    </option>
                    <option value="scheduled">Agendado</option>
                    <option value="presence">Presença</option>
                    <option value="absence">Ausência</option>
                    <option value="non-scheduled">Não agendado</option>
                  </Select>
                </>
              )}

              <strong>Tempo de aula</strong>
              <Select icon={FiClock} name="time" defaultValue="0">
                <option value="0" disabled>
                  Selecione tempo
                </option>
                {schedulesArray.map(schedule => (
                  <option
                    key={schedule.schedule_begin + schedule.schedule_end}
                    value={schedule.schedule_begin + schedule.schedule_end}
                  >
                    {schedule.schedule_name
                      ? `${schedule.schedule_name} (${schedule.schedule_begin} - ${schedule.schedule_end})`
                      : `${schedule.schedule_begin} - ${schedule.schedule_end}`}
                  </option>
                ))}
              </Select>

              <strong>Disciplina</strong>
              <Select icon={FiBook} name="subject" defaultValue="0">
                <option value="0" disabled>
                  Selecione disciplina
                </option>
                {subjectsArray.map(subject => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </Select>
            </section>
          </div>

          <section>
            <strong>Observações</strong>
            <Textarea name="observations" placeholder="Opcional" />
          </section>

          <Button type="submit">Agendar</Button>
        </Form>
      </Modal>
    </>
  );
};

export default ModalCreateAppointment;
