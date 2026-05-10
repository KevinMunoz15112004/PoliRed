import { Router } from 'express'
import { login } from '../controllers/authController.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'

const router = Router()

router.post('/auth/login', validators.loginValidator, validateResult, login)

export default router
