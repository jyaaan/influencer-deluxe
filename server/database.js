const databaseConfig = require('./database-config');
const knex = require('knex')({
  client: 'postgresql',
  connection: {
    user: 'johny',
    password: 'peanut',
    database: 'truefluence'
  }
});

function Database() {

}

// SELECT ETC
// FROM users
// WHERE id IN (SELECT id FROM relationships WHERE following_id = userId)
// ORDER BY follower_count DESC LIMIT 10

// knex.select('name').from('users')
// .whereIn('account_id', function() {
//   this.select('id').from('accounts');
// })
// Outputs:
// select `name` from `users` where `account_id` in (select `id` from `accounts`)

// var subquery = knex('users').where('votes', '>', 100).andWhere('status', 'active').orWhere('name', 'John').select('id');

// knex('accounts').where('id', 'in', subquery)

Database.prototype.topFollowed = function (userId) {
  var subquery = knex('relationships').where('following_id', userId).select('user_id');

  return knex('users')
    .select('username', 'picture_url', 'follower_count', 'recent_like_count', 'post_count', 'external_id', 'private')
    .where('id', 'in', subquery)
    .orderBy('follower_count', 'desc')
    .limit(10);
}


Database.prototype.clearTable = function (tablename) {
  return knex(tableName).truncate();
}

Database.prototype.getMedias = function (userId) {
  // console.log('get medias userid:', userId);
  return new Promise((resolve, reject) => {
    knex('medias')
      .select('*')
      .where('user_id', userId)
      .then(result => {
        resolve(result);
      })
      .catch(err => {
        reject(err);
      })
  })

}

Database.prototype.getFollowers = function (userId) {
  return new Promise((resolve, reject) => {
    knex('relationships')
      .select('user_id')
      .where('following_id', userId)
      .andWhere('following', true)
      .then(result => {
        resolve(result);
      })
  })
}

Database.prototype.createRelationship = function (userId, followingId, following) {
  const timeNow = new Date(Date.now()).toISOString();
  const relationship = {
    user_id: userId,
    following_id: followingId,
    created_at: timeNow,
    updated_at: timeNow,
    following: following
  };
  return knex('relationships')
    .insert(relationship);
}

Database.prototype.updateRelationship = function (userId, followingId, following) {
  const timeNow = new Date(Date.now()).toISOString();
  const relationship = {
    updated_at: timeNow,
    following: following
  };
  return knex('relationships')
    .where('user_id', userId)
    .andWhere('following_id', followingId)
    .update(relationship);
}

Database.prototype.upsertRelationship = function (userId, followingId, following = true) {
  return new Promise((resolve, reject) => {
    knex('relationships')
      .count('*')
      .where('user_id', userId)
      .andWhere('following_id', followingId)
        .then(result => {
          const count = Number(result[0].count);
          if (count > 0) {
            this.updateRelationship(userId, followingId, following)
              .then(result => {
                console.log('relationship updated for', userId);
              })
              .catch(err => {
                console.log('could not update relationship for', userId);
              });
          } else {
            this.createRelationship(userId, followingId, following)
              .then(result => {
                console.log('relationship created for', userId);
              })
              .catch(err => {
                console.log('could not create relationship for', userId);
              });
          }
          resolve('complete');
        })
  })
}

Database.prototype.getNextQueue = function (botId) {
  return knex('users')
    .select('username', 'task_id', 'id')
    .whereRaw('id % 4 = ?', [botId])
    .whereNotNull('task_id')
    .limit(1)
}

Database.prototype.completeScrape = function (username) {
  return knex('users')
    .where('username', username)
    .update({task_id: null})
}

Database.prototype.getIdFromExternalId = function (externalId, tableName) {
  return knex(tableName)
    .where('external_id', externalId)
    .select('id')
    .limit(1);
}

Database.prototype.createUser = function (user) {
  const timeNow = new Date(Date.now()).toISOString();
  user.created_at = timeNow;
  user.updated_at = timeNow;
  return knex('users')
    .returning('id')
    .insert(user);
}

Database.prototype.updateUser = function (user) {
  const timeNow = new Date(Date.now()).toISOString();
  user.updated_at = timeNow;
  return knex('users')
    .where('external_id', user.external_id)
    .returning('id')
    .update(user);
}

Database.prototype.upsertMedia = function (media) {
  return new Promise((resolve, reject) => {
    knex('medias')
      .count('*')
      .where('external_id', media.external_id)
      .then(result => {
        const count = Number(result[0].count);
        if (count> 0) {
          // do nothing for now
        } else {
          this.createMedia(media)
            .then(result => {
              //success
              resolve('complete');
            })
            .catch(err => {
              console.error(err);
            })
        }
      })
  })
}

Database.prototype.getUserByUsername = function (username) {
  return new Promise((resolve, reject) => {
    knex('users')
      .select('*')
      .where('username', username)
      .then(result => {
        resolve(result[0])
      });
  });
}

Database.prototype.getUserById = function (id) {
  return new Promise((resolve, reject) => {
    knex('users')
      .select('*')
      .where('id', id)
      .then(result => {
        resolve(result[0])
      });
  });
}

Database.prototype.usernameExists = function (username) {
  return new Promise((resolve, reject) => {
    knex('users')
      .count('*')
      .where('username', username)
      .then(result => {
        resolve(result[0].count > 0);
      });
  });
}

Database.prototype.createTask = function (primaryUserId) {
  const timeNow = new Date(Date.now()).toISOString();
  const task = {
    primary_user_id: primaryUserId,
    type: 'scrape',
    created_at: timeNow,
    status: 'queued',
    count: 0,
  }
  return knex('tasks').insert(task);
}

Database.prototype.taskExists = function (primaryUserId) {
  return new Promise((resolve, reject) => {
    knex('tasks')
      .count('*')
      .where('primary_user_id', primaryUserId)
      .then(result => {
        resolve(result[0].count > 0);
      });
  });
}

Database.prototype.updateTask = function (task) {
  return knex('tasks')
      .where('id', task.id)
      .update(task);

}

Database.prototype.getTask = function (taskId) {
  return knex('tasks')
    .select('*')
    .where('id', taskId)
}

Database.prototype.getTaskByUserId = function (userId) {
  return new Promise((resolve, reject) => {
    knex('tasks')
      .select('*')
      .where('primary_user_id', userId)
      .then(result => {
        resolve(result);
      })
  })
}

Database.prototype.getNextTask = function () {
  return knex('tasks')
    .select('*')
    .where('follower_list_complete', false)
    .orderBy('created_at', 'asc')
    .limit(1)
}

Database.prototype.updateTask = function (taskId, params) {
  return knex('tasks')
    .where('id', taskId)
    .update(params)
}

Database.prototype.upsertUser = function (user) {
  return new Promise((resolve, reject) => {
    knex('users')
      .count('*')
      .where('external_id', user.external_id)
      .then(result => {
        const count = Number(result[0].count);
        if (count > 0) {
          this.updateUser(user)
            .then(result => {
              console.log('user updated');
              resolve(result);
            })
            .catch(err => {
              console.log('error updating user');
            })
        } else {
          this.createUser(user)
            .then(result => {
              console.log('user created');
              resolve(result);
            })
            .catch(err => {
              console.error(err);
            })
        }
        // resolve('complete');
      })
  })
}

Database.prototype.queueFollower = function (profile) {
  return new Promise((resolve, reject) => {
    this.upsertUser(profile)
      .then(result => {
        resolve(result);
      })
  })
}

Database.prototype.queueExists = function (username) {
    return new Promise((resolve, reject) => {
      knex('user')
        .count('*')
        .where('username', username)
        .then(result => {
          resolve(result[0].count > 0);
        });
  });
}


Database.prototype.createMedia = function (media) {
  const timeNow = new Date(Date.now()).toISOString();
  media.created_at = timeNow;
  media.updated_at = timeNow;
  return knex('medias')
    .insert(media);
}

Database.prototype.updateMedia = function (media) {
  const timeNow = new Date(Date.now()).toISOString();
  media.updated_at = timeNow;
  return knex('medias')
    .where('external_id', media.external_id)
    .update(media);
}

Database.prototype.insertObjects = function (tableName, arrObjData) {
  return knex.transaction((trx) => {
    return knex.batchInsert(tableName, arrObjData)
      .transacting(trx)
      .then(trx.commit)
      .catch(trx.rollback);
  })
    .then(() => {
      console.log('transaction successful')
      return 'transaction successful';
    })
    .catch(() => {
      console.log('transaction failed');
      return 'transaction failed';
    });
}

exports.Database = Database;
