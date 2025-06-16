const Joi = require('joi');

exports.registerSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 3 characters',
      'string.max': 'Name must be at most 30 characters'
    }),

phoneNo: Joi.string()
  .pattern(/^\d{10}$/)
  .required()
  .messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Phone number must be exactly 10 digits',
  }),


  password: Joi.string()
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}$"
      )
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Password must be at least 8 characters long, and include uppercase, lowercase, number, and special character'
    }),
    email: Joi.string().email().required().messages({
        'string.empty': 'Email is required'
    }),

    
});

exports.loginSchema = Joi.object({
  email: Joi.string().email()
    .required()
    .messages({
      'string.empty': 'email is required'
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    })
});

exports.newContactSchema = Joi.object({


    name: Joi.string().required().messages({
      'string.empty':'name is required'
    }),

phone: Joi.string()
  .pattern(/^\d{10}$/)
  .required()
  .messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Phone number must be exactly 10 digits',
  })

});
exports.verifyemail = Joi.object({
    email: Joi.string().email().required().messages({
        'string.empty': 'Email is required'
    }),
})
exports.passwordChange = Joi.object({
   currentPassword: Joi.string()
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}$"
      )
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Password must be at least 8 characters long, and include uppercase, lowercase, number, and special character'
    }),
       newPassword: Joi.string()
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}$"
      )
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Password must be at least 8 characters long, and include uppercase, lowercase, number, and special character'
    }),
       confirmPassword: Joi.string()
    .pattern(
      new RegExp(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}$"
      )
    )
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Password must be at least 8 characters long, and include uppercase, lowercase, number, and special character'
    }),
})


exports.pinSchema = Joi.object({
  pin: Joi.alternatives().try(
    Joi.string().pattern(/^\d{6}$/).messages({
      'string.pattern.base': 'PIN must be exactly 6 digits',
    }),
    Joi.valid(null)
  ).optional(),

  isPin: Joi.boolean().required(),
});


