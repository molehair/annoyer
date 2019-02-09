const trash = require('trash');

const cleanList = ['node_modules', 'build', 'src/lib', 'public/lib'];

trash(cleanList).then(() => {
  console.log('done');
}).catch(err => {
  console.error(err);
});