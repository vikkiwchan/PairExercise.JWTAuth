const Sequelize = require('sequelize');
const { STRING, INTEGER } = Sequelize;
const config = {
  logging: false,
};
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
  id: {
    type: INTEGER,
    primaryKey: true,
  },
});

User.beforeCreate(async (user) => {
  if (user._changed.has('password')) {
    user.password = await bcrypt.hash(user.password, 5);
  }
});

// User.addHook('beforeSave', async function (user) {
//   if (user._changed.has('password')) {
//     user.password = await bcrypt.hash(user.password, 5);
//   }
// });

User.byToken = async (token) => {
  try {
    const { id } = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(id);
    if (user) {
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username, // do not include passwod, bc an exitisng password will be different & hashed
    },
  });
  if (user && (await bcrypt.compare(password, user.password))) {
    return jwt.sign({ id: user.id }, process.env.JWT);
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const Note = conn.define('note', {
  text: STRING,
});

Note.byToken = async (token, reqId) => {
  try {
    const { id } = jwt.verify(token, process.env.JWT);
    // console.log('-----> id', id);
    // console.log('-----> paramsId', reqId);
    if (id === +reqId) {
      const notes = await Note.findAll({ where: { userId: id } });
      return notes;
    }
    const error = Error('unauthorized access');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('unauthorized access');
    error.status = 401;
    throw error;
  }
};

// Note.byToken = async function(token) {
//   try {
//     const {id} = jwt.verify(token, process.env.JWT);
//     const user = await Note.findByPk(id);
//   }
//   catch(ex){

//   }
// }

User.hasMany(Note);
Note.belongsTo(User);

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw', id: 1 },
    { username: 'moe', password: 'moe_pw', id: 2 },
    { username: 'larry', password: 'larry_pw', id: 3 },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [
    { text: 'likes TV sitcoms' },
    { text: 'likes reality TV' },
    { text: 'likes slow burners' },
  ];
  const [noteLucy, noteMoe, noteLarry] = await Promise.all(
    notes.map((note) => Note.create(note))
  );
  await lucy.setNotes(noteLucy);
  await moe.setNotes(noteMoe);
  await larry.setNotes(noteLarry);
  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: { noteLucy, noteMoe, noteLarry },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
