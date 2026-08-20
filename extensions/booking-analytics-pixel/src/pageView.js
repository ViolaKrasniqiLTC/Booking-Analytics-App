import { register } from '@shopify/web-pixels-extension';

register(({ analytics }) => {
  analytics.subscribe('page_viewed', (event) => {
    console.log('====================');
    console.log('PAGE VIEWED!');
    console.log('Event name:', event.name);
    console.log('Event ID:', event.id);
    console.log('Timestamp:', event.timestamp);
    console.log('Client ID:', event.clientId);
    console.log('Page URL:', event.context.document.location.href);
    console.log('Full event:', event);
    console.log('====================');
  });
});