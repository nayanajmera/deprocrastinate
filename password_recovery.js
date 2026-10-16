const bcrypt = require('bcryptjs');
async function getPassword(password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
}
getPassword('new_password');//print hash of new password from here.