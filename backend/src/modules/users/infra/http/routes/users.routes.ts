import { Router } from 'express';
import multer from 'multer';
import { celebrate, Segments, Joi } from 'celebrate';

import uploadConfig from '@config/upload';

import ensureAuthenticated from '@shared/infra/http/middlewares/ensureAuthenticated';

import UsersController from '../controllers/UsersController';
import UserAvatarController from '../controllers/UserAvatarController';

const usersRouter = Router();

const upload = multer(uploadConfig.multer);

const usersController = new UsersController();
const userAvatarController = new UserAvatarController();

usersRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      position: Joi.string().required(),
      subjects: Joi.string().when('position', {
        is: 'teacher',
        then: Joi.required(),
        otherwise: Joi.allow(''),
      }),
      password: Joi.string().required(),
    },
  }),
  usersController.create,
);

usersRouter.put(
  '/',
  ensureAuthenticated,
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      position: Joi.string().required(),
      subjects: Joi.string().when('position', {
        is: 'teacher',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      password: Joi.string().min(6),
    },
  }),
  usersController.update,
);

usersRouter.delete('/', ensureAuthenticated, usersController.delete);

usersRouter.get('/', ensureAuthenticated, usersController.show);

usersRouter.patch(
  '/avatar',
  ensureAuthenticated,
  upload.single('avatar'),
  userAvatarController.update,
);

export default usersRouter;
