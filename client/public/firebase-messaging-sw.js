// Listen for incoming push notifications
self.addEventListener('push', function (event) {
  const {data} = event.data.json() || {};
  const image = data.image || '/images/icons/icon-72x72.png';
  const title = data.title || 'Annoyer';
  let url = '/';

  if(data.notiType === '1') {
    //-- practice --//
    url = '/?action=practice&stackId=' + data.stackId + '&curIndices=' + data.curIndices;
  } else if(data.notiType === '2') {
    //-- test --//
    url = '/?action=test&stackId=' + data.stackId;
  } else if(data.notiType === '3') {
    //-- announcement --//
  }

  // Notification options
  const options = {
    body: 'Bump yourself up!',
    icon: image,
    badge: image,
    data: {
      url: url
    },
    requireInteraction: true,
  };

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