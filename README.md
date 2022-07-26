# De Windcentrale winddelen
Let Homey monitor the output of your Windcentrale 'winddelen' (shares in a windmill, see https://www.windcentrale.nl/). This app allows you to create triggers based on the current power output, and, perhaps more useful, view production statistics using Insights. 

Based on the 'Solar panels' app by Diederik Bakker.

![](https://drive.google.com/uc?id=0B4QdLfQ7j41JOHB4ZTVOQjdlV0U)
![](https://drive.google.com/uc?id=0B4QdLfQ7j41JU0hyTTFOQTNWUG8)

---
# Adding a Windcentrale windmill
Select the windmill you participate in and enter the number of 'winddelen' (shares):
![](https://drive.google.com/uc?id=0B4QdLfQ7j41JVEYxRXc0Q0lhOGc)

---

# Features
## Current production data
Homey shows your winddelen output as a sensor. This app currently includes the following metrics (all per 'winddeel' or share): current power, current energy production (reset daily), the yearly production, and the lifetime production. 

## Flow
The Winddelen app can be used as a sensor for Homey. This allows you to use logic on your production data. 

## Insights
Homey retrieves data from the 'Windcentrale' every minute, but only logs new data. You can add more than one windmill, and each will be logged in a separate graph.

