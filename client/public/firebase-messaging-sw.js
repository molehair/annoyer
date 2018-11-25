// Listen for incoming push notifications
self.addEventListener('push', function (event) {
  const {data} = event.data.json() || {};
  const image = data.image || '/images/icons/icon-72x72.png';
  const title = data.title || 'Annoyer';

  // Notification options
  const options = {
    body: '',
    icon: image,
    badge: image,
    data: {
      url: '/',
    },
    requireInteraction: true,
  };

  if(data.notiType === '1') {
    //-- practice --//
    options.body = 'Bump yourself up!';
    options.data.url = '/?action=practice&stackId=' + data.stackId + '&curIndices=' + data.curIndices;
  } else if(data.notiType === '2') {
    //-- test --//
    options.body = 'End of the day!';
    options.data.url = '/?action=test&stackId=' + data.stackId;
  } else if(data.notiType === '3') {
    //-- announcement --//
    options.body = data.msg;
  }

  // Wait until notification is shown
  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for notification click event
self.addEventListener('notificationclick', function (event) {
  // Hide notification
  event.notification.close();

  // Attempt to extract notification URL
  var url = event.notification.data.url;

  // Check if it exists
  if (url) {
    // Open the target URL in a new tab/window
    event.waitUntil(clients.openWindow(url));
  }
});