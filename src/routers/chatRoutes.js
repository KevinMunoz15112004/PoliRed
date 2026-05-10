import { Router } from 'express'
import { handleChat } from '../controllers/chatController.js'
import validators from '../validators/index.js'
import validateResult from '../validators/validateResult.js'

const router = Router()

router.post('/chatbot', validators.trimAndNotEmpty('message'), validateResult, handleChat)

export default router