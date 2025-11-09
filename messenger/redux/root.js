import userReducer from './reducers/user';
import chatReducer from './reducers/chat';
// import chatReducer from './chatReducer';
// import messageReducer from './messageReducer';
import { combineReducers } from 'redux';

const rootReducer = combineReducers({
  user: userReducer,
  chat: chatReducer,
//   message: messageReducer,
});

export default rootReducer;