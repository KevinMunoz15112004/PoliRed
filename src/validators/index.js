import * as common from './commonValidators.js'
import * as string from './stringValidators.js'
import * as mongo from './mongoValidators.js'
import * as auth from './authValidators.js'
import * as report from './reportValidators.js'

export const validators = {
  // common
  trimAndNotEmpty: common.trimAndNotEmpty,
  normalizeEmail: common.normalizeEmail,
  passwordField: common.passwordField,
  phone: common.phone,
  number: common.numberField,
  // string
  name: string.nameValidator,
  username: string.usernameValidator,
  title: string.titleValidator,
  description: string.descriptionValidator,
  // mongo
  tokenParam: mongo.tokenParam,
  mongoIdParam: mongo.mongoIdParam,
  mongoIdBody: mongo.mongoIdBody,
  // boolean
  booleanBody: common.booleanBody,
  // auth composed
  loginValidator: auth.loginValidator,
  recuperarPasswordValidator: auth.recuperarPasswordValidator,
  crearNuevoPasswordValidator: auth.crearNuevoPasswordValidator,
  actualizarPasswordValidator: auth.actualizarPasswordValidator,
  actualizarPerfilValidator: auth.actualizarPerfilValidator,
  mongoIdParamValidator: auth.mongoIdParamValidator
  ,
  // report validators
  reportPublicacionValidator: report.reportPublicacionValidator,
  reportAppValidator: report.reportAppValidator,
  reportUsuarioValidator: report.reportUsuarioValidator
  ,
  rehabilitarUsuarioValidator: report.rehabilitarUsuarioValidator
}

export default validators
