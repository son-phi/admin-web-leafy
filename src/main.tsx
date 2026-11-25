import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './ui/App';
import './style.css';
const theme=createTheme({palette:{primary:{main:'#23674e'},background:{default:'#f4f7f5'}},typography:{fontFamily:'"Segoe UI", sans-serif',button:{textTransform:'none',fontWeight:600}},shape:{borderRadius:12}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider theme={theme}><CssBaseline/><BrowserRouter><App/></BrowserRouter></ThemeProvider></React.StrictMode>);
